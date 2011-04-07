# == Schema Info
#
# Table name: forums
#
#  id           :integer         not null, primary key
#  category_id  :integer
#  name         :string(255)
#  description  :text
#  topics_count :integer         default(0)
#  posts_count  :integer         default(0)
#  position     :integer         default(0)

require 'test_helper'

class ForumTest < ActiveSupport::TestCase
  fixtures :all
  
  def test_to_s
    f = Forum.find(1)
    assert_equal f.to_s, 'test forum'
  end  

end
