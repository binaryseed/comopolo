# == Schema Info
#
# Table name: comments
#
#  id            :integer         not null, primary key
#  user_id       :integer
#  resource_id   :integer
#  resource_type :string(255)
#  body          :text
#  created_at    :datetime
#  updated_at    :datetime

require 'test_helper'

class CommentTest < ActiveSupport::TestCase
  # Replace this with your real tests.
  def test_truth
    assert true
  end
end
