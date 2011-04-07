# == Schema Info
#
# Table name: events
#
#  id          :integer         not null, primary key
#  title       :string(255)
#  description :text
#  date        :datetime
#  reminder    :boolean
#  user_id     :integer
#  created_at  :datetime
#  updated_at  :datetime

class Event < ActiveRecord::Base
  
  attr_accessible :title, :description, :date, :reminder
  
  belongs_to :user
  
  validates_presence_of :title, :description, :date, :user_id
    
  named_scope :reminders, lambda {|*args| {:conditions => {:reminder => true, :date => Time.now.utc-2.hours..Time.now.utc+6.hours}, :order => 'date asc'}}
  
  def to_s
    "#{title} at #{date.strftime("%I:%M %p")}"
  end
  
  def to_param
    "#{id}-#{to_s.parameterize}"
  end
  
end
